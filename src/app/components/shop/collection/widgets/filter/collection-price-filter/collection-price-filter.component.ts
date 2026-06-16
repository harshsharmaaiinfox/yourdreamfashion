import { Component, Input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Params } from '../../../../../../shared/interface/core.interface';

@Component({
  selector: 'app-collection-price-filter',
  templateUrl: './collection-price-filter.component.html',
  styleUrls: ['./collection-price-filter.component.scss']
})
export class CollectionPriceFilterComponent {

  @Input() filter: Params;

  public minPrice: number = 300;
  public maxPrice: number = 15000; // Default max range
  public price: { min: number, max: number } = { min: 300, max: 15000 };

  constructor(private route: ActivatedRoute,
    private router: Router) {
  }

  ngOnChanges() {
    if (this.filter['price']) {
      // Expecting format: price=100-500
      const prices = this.filter['price'].split('-');
      if (prices.length === 2) {
        this.price = {
          min: +prices[0],
          max: +prices[1]
        };
      }
    } else {
      this.price = { min: this.minPrice, max: this.maxPrice };
    }
  }

  // Handle slider changes
  sliderChange(value: number, type: 'min' | 'max') {
    if (type === 'min') {
      if (value > this.price.max) {
        this.price.min = this.price.max;
      } else {
        this.price.min = value;
      }
    } else {
      if (value < this.price.min) {
        this.price.max = this.price.min;
      } else {
        this.price.max = value;
      }
    }
    this.applyFilter();
  }

  // Handle manual input changes
  inputChange(value: number, type: 'min' | 'max') {
    value = Number(value);
    if (isNaN(value)) return;

    if (type === 'min') {
      if (value < this.minPrice) value = this.minPrice;
      if (value > this.price.max) value = this.price.max; // don't let min exceed max
      this.price.min = value;
    } else {
      if (value > this.maxPrice) value = this.maxPrice;
      if (value < this.price.min) value = this.price.min; // don't let max go below min
      this.price.max = value;
    }
    this.applyFilter(); // commit on blur, not only on Enter
  }

  applyFilter() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        price: `${this.price.min}-${this.price.max}`,
        page: 1
      },
      queryParamsHandling: 'merge',
      skipLocationChange: false
    });
  }

  reset() {
    this.price = {
      min: this.minPrice,
      max: this.maxPrice
    };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        price: null,
        page: 1
      },
      queryParamsHandling: 'merge',
      skipLocationChange: false
    });
  }

}
