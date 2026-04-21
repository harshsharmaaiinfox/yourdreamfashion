import { Component, Input, ViewChild } from '@angular/core';
import { Product } from '../../../../../interface/product.interface';
import { Cart, CartAddOrUpdate } from '../../../../../interface/cart.interface';
import { AddToCart } from '../../../../../action/cart.action';
import { Select, Store } from '@ngxs/store';
import { CartState } from '../../../../../state/cart.state';
import { Observable } from 'rxjs';
import { ProductDetailModalComponent } from '../../../modal/product-detail-modal/product-detail-modal.component';

@Component({
  selector: 'app-product-cart-button',
  templateUrl: './product-cart-button.component.html',
  styleUrl: './product-cart-button.component.scss'
})
export class ProductCartButtonComponent {
  
  @Input() product: Product;
  @Input() text: string;
  @Input() iconClass: string;
  
  @Select(CartState.cartItems) cartItem$: Observable<Cart[]>;

  @ViewChild("productDetailModal") productDetailModal: ProductDetailModalComponent;

  public cartItem: Cart | null;
  public currentDate: number | null;
  public saleStartDate: number | null;

  constructor(private store: Store) {
	}

  ngOnInit() {
    this.cartItem$.subscribe(items => {
      this.cartItem = items.find(item => item.product.id == this.product.id)!;
    });
  }

  addToCart(product: Product, qty: number) {
    const params: CartAddOrUpdate = {
      id: this.cartItem ? this.cartItem.id : null,
      product: product,
      product_id: product?.id,
      variation_id: this.cartItem ? this.cartItem?.variation_id : null,
      variation: this.cartItem ? this.cartItem?.variation : null,
      quantity: qty
    }
    this.store.dispatch(new AddToCart(params));
    this.writeGuestCart(product, qty);
  }

  private writeGuestCart(product: Product, qty: number) {
    const token = (this.store.selectSnapshot((s: any) => s.auth?.access_token)) || '';
    const user = this.store.selectSnapshot((s: any) => s.account?.user);
    if (token && user) return; // logged in — server cart handles it
    try {
      const raw = localStorage.getItem('guest_cart');
      const parsed = raw ? JSON.parse(raw) : { items: [], total: 0, is_digital_only: false };
      const items: any[] = parsed.items || [];
      const idx = items.findIndex(i => i.product_id === product.id && !i.variation_id);
      if (idx >= 0) {
        items[idx].quantity = Math.max(0, (items[idx].quantity || 0) + qty);
        items[idx].sub_total = items[idx].quantity * (product.sale_price || 0);
        if (items[idx].quantity <= 0) items.splice(idx, 1);
      } else if (qty > 0) {
        items.push({
          id: Number(Math.floor(Math.random() * 100000)),
          quantity: qty,
          sub_total: qty * (product.sale_price || 0),
          product: product,
          product_id: product.id,
          wholesale_price: null,
          variation: null,
          variation_id: null,
        });
      }
      const total = items.reduce((p, c) => p + Number(c.sub_total || 0), 0);
      localStorage.setItem('guest_cart', JSON.stringify({
        items, total, is_digital_only: false
      }));
    } catch {}
  }

  externalProductLink(link: string) {
    if(link) {
      window.open(link, "_blank");
    }
  }

}
